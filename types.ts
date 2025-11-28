export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUrl?: string; // data URL for rendering
}

export interface User {
  name: string;
  email: string;
  picture: string;
}
