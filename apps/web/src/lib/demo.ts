export type DemoRole = 'admin' | 'viewer';

export interface DemoAccount {
  role: DemoRole;
  label: string;
  email: string;
  password: string;
  summary: string;
  capabilities: string[];
}

export function demoAccounts(): DemoAccount[] {
  if (process.env.DEMO_MODE !== 'true') return [];
  const admin = {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  };
  const viewer = {
    email: process.env.SEED_VIEWER_EMAIL,
    password: process.env.SEED_VIEWER_PASSWORD,
  };
  const accounts: DemoAccount[] = [];
  if (admin.email && admin.password) {
    accounts.push({
      role: 'admin',
      label: 'Admin',
      ...admin,
      summary: 'Runs the register.',
      capabilities: [
        'Register and edit doctors',
        'Add, edit and remove patients',
        'Read the dashboard and every list',
      ],
    } as DemoAccount);
  }
  if (viewer.email && viewer.password) {
    accounts.push({
      role: 'viewer',
      label: 'Viewer',
      ...viewer,
      summary: 'Reads the register.',
      capabilities: [
        'Browse doctors and patients',
        'Read the dashboard',
        'No controls to change anything',
      ],
    } as DemoAccount);
  }
  return accounts;
}
