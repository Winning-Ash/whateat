import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exclusion } from './exclusions.schema';
import { AddExclusionDto } from './exclusions.dto';

@Injectable()
export class ExclusionsService implements OnModuleInit {
  constructor(@InjectModel('Exclusion') private readonly exclusions: Model<Exclusion>) {}
  async onModuleInit() { await this.exclusions.init(); }

  async list(userId: string) {
    return this.exclusions.find({ userId }).select('restaurantId restaurantName createdAt -_id').sort({ createdAt: -1 }).lean();
  }
  async ids(userId: string): Promise<string[]> {
    return this.exclusions.distinct('restaurantId', { userId });
  }
  async add(userId: string, value: AddExclusionDto) {
    const filter = { userId, restaurantId: value.restaurantId };
    const update = { $set: { restaurantName: value.restaurantName } };
    try {
      await this.exclusions.updateOne(filter, update, { upsert: true, runValidators: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      // Simultaneous additions still represent one exclusion for this member.
      await this.exclusions.updateOne(filter, update, { runValidators: true });
    }
  }
  async remove(userId: string, restaurantId: string) {
    await this.exclusions.deleteOne({ userId, restaurantId });
  }
}
