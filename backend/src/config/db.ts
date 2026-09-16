import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] Disconnected from MongoDB');
    });
  } catch (err) {
    console.error('[DB] Initial connection failed:', err);
    process.exit(1);
  }
}
