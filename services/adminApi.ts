import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
import type { AccessScope, Role } from '../types';

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
  accessScope?: AccessScope;
  siteIds?: string[];
};

export type CreateUserOutput = {
  uid: string;
};

export const createUserAccount = async (input: CreateUserInput) => {
  const callable = httpsCallable<CreateUserInput, CreateUserOutput>(functions, 'createUser');
  const result = await callable(input);
  return result.data;
};

export type SetUserStatusInput = {
  uid: string;
  disabled: boolean;
};

export type SetUserStatusOutput = {
  uid: string;
  disabled: boolean;
};

export const setUserStatus = async (input: SetUserStatusInput) => {
  const callable = httpsCallable<SetUserStatusInput, SetUserStatusOutput>(functions, 'setUserStatus');
  const result = await callable(input);
  return result.data;
};
