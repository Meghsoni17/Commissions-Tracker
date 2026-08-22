export interface Role {
  id: string;
  name: string;
  colorSlot: number; // 1-8, index into the categorical palette
  archived: boolean;
  createdAt: string; // ISO date
}

export interface WeekEntry {
  id: string;
  roleId: string;
  weekStart: string; // ISO date (Monday) identifying the week
  booked: number;
  showed: number;
  closed: number;
  commission: number;
  notes?: string;
}

export interface AppData {
  roles: Role[];
  entries: WeekEntry[];
  isSample?: boolean;
}
