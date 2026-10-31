"use client";

import { createContext, useContext } from "react";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan: string;
  organizationId?: string | null;
  creatorId?: string | null;
  creator?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  subscriptionStatus?: string;
  requestsThisMonth?: number;
  monthlyRequestLimit?: number;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  ownerId?: string | null;
  role: string;
  plan?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  systemRole: string;
  emailVerified?: string | null;
}

export interface DashboardContextType {
  user: UserInfo | null;
  workspaces: WorkspaceInfo[];
  organizations: OrganizationInfo[];
  activeWorkspace: WorkspaceInfo | null;
  activeOrganization: OrganizationInfo | null;
  setActiveWorkspaceId: (id: string) => void;
  setActiveOrgId: (id: string) => void;
  refreshUserData: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextType>({
  user: null,
  workspaces: [],
  organizations: [],
  activeWorkspace: null,
  activeOrganization: null,
  setActiveWorkspaceId: () => {},
  setActiveOrgId: () => {},
  refreshUserData: async () => {},
});

export const useDashboard = () => useContext(DashboardContext);
