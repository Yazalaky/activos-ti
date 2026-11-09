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

export type ResetSiteInventoryInput = {
  siteId: string;
  confirmation: string;
};

export type ResetDependencyItem = {
  id: string;
  date: string;
  assetLabel: string;
  title: string;
  status: string;
  isDeleted: boolean;
};

export type ResetDependencyGroup = {
  collection: string;
  label: string;
  count: number;
  items?: ResetDependencyItem[];
};

export type PreviewSiteInventoryResetOutput = {
  siteId: string;
  siteName: string;
  prefix: string;
  assetCount: number;
  blocking: ResetDependencyGroup[];
  preserved: ResetDependencyGroup[];
  actsToRetire: ResetDependencyGroup;
};

export const previewSiteInventoryReset = async (siteId: string) => {
  const callable = httpsCallable<{ siteId: string }, PreviewSiteInventoryResetOutput>(functions, 'previewSiteInventoryReset');
  const result = await callable({ siteId });
  return result.data;
};

export type ResetSiteInventoryOutput = {
  resetId: string;
  siteId: string;
  deletedAssets: number;
  retiredActs: number;
  deletedStorageFiles: number;
  storageCleanupPending: boolean;
};

export const resetSiteInventory = async (input: ResetSiteInventoryInput) => {
  const callable = httpsCallable<ResetSiteInventoryInput, ResetSiteInventoryOutput>(functions, 'resetSiteInventory');
  const result = await callable(input);
  return result.data;
};
