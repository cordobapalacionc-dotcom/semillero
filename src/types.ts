export interface User {
  id: number;
  username: string;
}

export interface Photo {
  id: number;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  uploader: User;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: User;
}
