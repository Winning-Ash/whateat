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
    return this.likes.find({ userId }).select('restaurantId restaurantName createdAt listIds -_id').sort({ createdAt: -1 }).lean();
  }
  async ids(userId: string): Promise<string[]> {
    return this.likes.distinct('restaurantId', { userId });
  }
  async add(userId: string, value: AddLikeDto, session?: ClientSession) {
    const filter = { userId, restaurantId: value.restaurantId };
    const update = { $set: { restaurantName: value.restaurantName }, $addToSet: { listIds: 'default' } };
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

  async listInList(userId: string, listId: string) {
    return this.likes.find({ userId, $or: [
      { listIds: listId }, ...(listId === 'default' ? [{ listIds: { $exists: false } }] : []),
    ] }).select('restaurantId restaurantName createdAt -_id').sort({ createdAt: -1 }).lean();
  }

  async addToList(userId: string, listId: string, value: AddLikeDto, session: ClientSession) {
    const filter = { userId, restaurantId: value.restaurantId };
    // Preserve legacy default membership when first adding a second membership.
    await this.likes.updateOne({ ...filter, listIds: { $exists: false } },
      { $set: { listIds: ['default'] } }, { session });
    await this.likes.updateOne(filter, { $set: { restaurantName: value.restaurantName },
      $addToSet: { listIds: listId } }, { upsert: true, runValidators: true, session });
  }

  async removeFromList(userId: string, listId: string, restaurantId: string, session: ClientSession) {
    const filter = { userId, restaurantId };
    await this.likes.updateOne({ ...filter, listIds: { $exists: false } },
      { $set: { listIds: ['default'] } }, { session });
    await this.likes.updateOne(filter, { $pull: { listIds: listId } }, { session });
    await this.likes.deleteOne({ ...filter, listIds: { $size: 0 } }, { session });
  }

  async removeList(userId: string, listId: string, session: ClientSession) {
    await this.likes.updateMany({ userId, listIds: listId }, { $pull: { listIds: listId } }, { session });
    await this.likes.deleteMany({ userId, listIds: { $size: 0 } }, { session });
  }
}
