import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
import type { Role } from '../types';

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

export type CreateUserOutput = {
  uid: string;
};

export const createUserAccount = async (input: CreateUserInput) => {
  const callable = httpsCallable<CreateUserInput, CreateUserOutput>(functions, 'createUser');
  const result = await callable(input);
  return result.data;
};
