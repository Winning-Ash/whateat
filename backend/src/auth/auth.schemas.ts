import { Schema, Types } from 'mongoose';

export interface Member {
  _id: Types.ObjectId;
  kakaoId: string;
  nickname: string;
  writeVersion: number;
  defaultLikeListName?: string;
  likeLists?: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}
export const MemberSchema = new Schema<Member>({
  kakaoId: { type: String, required: true, unique: true },
  nickname: { type: String, required: true, maxlength: 100 },
  writeVersion: { type: Number, default: 0 },
  defaultLikeListName: { type: String, maxlength: 30 },
  likeLists: { type: [{ _id: false, id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 30 } }], default: undefined,
    validate: (lists: unknown[]) => lists.length <= 2 },
}, { timestamps: true, collection: 'users' });

export interface LoginSession { tokenHash: string; userId: Types.ObjectId; expiresAt: Date }
export const LoginSessionSchema = new Schema<LoginSession>({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'auth_sessions' });

export interface LoginState { tokenHash: string; expiresAt: Date }
export const LoginStateSchema = new Schema<LoginState>({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'auth_states' });
