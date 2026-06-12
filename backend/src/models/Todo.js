import mongoose from 'mongoose';

// End-to-end encrypted ToDo item.
// The entire payload (title, notes, due date, completed flag) is encrypted on
// the client with AES-GCM before it ever reaches the server. The server only
// stores opaque ciphertext + IV and can never read the contents.
const todoSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ciphertext: { type: String, required: true }, // base64
    iv: { type: String, required: true }, // base64
  },
  { timestamps: true },
);

todoSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this._id,
    ciphertext: this.ciphertext,
    iv: this.iv,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Todo = mongoose.model('Todo', todoSchema);
