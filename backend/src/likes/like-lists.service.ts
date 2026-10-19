import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Member } from '../auth/auth.schemas';
import { LikesService } from './likes.service';

@Injectable()
export class LikeListsService {
  constructor(@InjectModel('Member') private readonly members: Model<Member>, private readonly likes: LikesService) {}

  async list(userId: string, session?: ClientSession) {
    const member = await this.members.findById(userId).session(session ?? null).lean();
    if (!member) throw new UnauthorizedException();
    return [{ id: 'default', name: member.defaultLikeListName ?? '기본' }, ...(member.likeLists ?? [])];
  }

  async requireList(userId: string, listId: string, session?: ClientSession) {
    const lists = await this.list(userId, session);
    if (!lists.some(list => list.id === listId)) throw new NotFoundException('Like list not found');
    return lists;
  }

  // Controllers wrap every mutation in withMemberWrite, serializing list capacity,
  // membership changes and withdrawal through the same member transaction lock.
  async create(userId: string, name: string, session: ClientSession) {
    const lists = await this.list(userId, session);
    if (lists.length >= 3) throw new ConflictException('You can create up to 3 like lists');
    if (lists.some(list => list.name === name)) throw new ConflictException('List name already exists');
    const list = { id: new Types.ObjectId().toString(), name };
    await this.members.updateOne({ _id: userId }, { $push: { likeLists: list } }, { session, runValidators: true });
    return list;
  }

  async rename(userId: string, listId: string, name: string, session: ClientSession) {
    const lists = await this.requireList(userId, listId, session);
    if (lists.some(list => list.id !== listId && list.name === name)) throw new ConflictException('List name already exists');
    if (listId === 'default') {
      await this.members.updateOne({ _id: userId }, { $set: { defaultLikeListName: name } }, { session, runValidators: true });
    } else {
      await this.members.updateOne({ _id: userId, 'likeLists.id': listId },
        { $set: { 'likeLists.$.name': name } }, { session, runValidators: true });
    }
  }

  async remove(userId: string, listId: string, session: ClientSession) {
    await this.requireList(userId, listId, session);
    if (listId === 'default') throw new BadRequestException('The default list cannot be deleted');
    await this.likes.removeList(userId, listId, session);
    await this.members.updateOne({ _id: userId }, { $pull: { likeLists: { id: listId } } }, { session });
  }
}
