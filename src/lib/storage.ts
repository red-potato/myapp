
import { Message } from "../types";

const STORAGE_KEY = 'maya_chats_v1';

export const chatStorage = {
  getMessages: (): Message[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveMessages: (messages: Message[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
