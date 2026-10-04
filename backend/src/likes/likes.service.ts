import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Like } from './likes.schema';
import { AddLikeDto } from './likes.dto';

@Injectable()
export class LikesService implements OnModuleInit {
  constructor(@InjectModel('Like') private readonly likes: Model<Like>) {}
  async onModuleInit() { await this.likes.init(); }

  async list(userId: string) {
    return this.likes.find({ userId }).select('restaurantId restaurantName createdAt -_id').sort({ createdAt: -1 }).lean();
  }
  async ids(userId: string): Promise<string[]> {
    return this.likes.distinct('restaurantId', { userId });
  }
  async add(userId: string, value: AddLikeDto, session?: ClientSession) {
    const filter = { userId, restaurantId: value.restaurantId };
    const update = { $set: { restaurantName: value.restaurantName } };
    try {
      await this.likes.updateOne(filter, update, { upsert: true, runValidators: true, session });
    } catch (error) {
      if (session) throw error;
      if ((error as { code?: number }).code !== 11000) throw error;
      // Simultaneous additions still represent one like for this member.
      await this.likes.updateOne(filter, update, { runValidators: true });
    }
  }
  async remove(userId: string, restaurantId: string) {
    await this.likes.deleteOne({ userId, restaurantId });
  }
}
