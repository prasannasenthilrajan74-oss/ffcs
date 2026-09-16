import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  value: boolean | string | number;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);

/** Helper to get a settings value */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const doc = await Settings.findOne({ key });
  if (!doc) return defaultValue;
  return doc.value as T;
}

/** Helper to set a settings value */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  await Settings.findOneAndUpdate({ key }, { value }, { upsert: true });
}
