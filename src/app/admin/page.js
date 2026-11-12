'use client';
import { useState } from 'react';
import { Tabs } from '@/components/ui';
import {
  AdminOverviewPanel,
  GradesPanel,
  CoursesPanel,
  SeniorProfilesPanel,
  ModerationControlPanel,
  AccountsPanel,
  AuditPanel
} from '@/components/AdminPanels';

const PANELS = {
  overview: AdminOverviewPanel,
  seniors: SeniorProfilesPanel,
  courses: CoursesPanel,
  grades: GradesPanel,
  moderation: ModerationControlPanel,
  accounts: AccountsPanel,
  audit: AuditPanel,
};

const TABS = [
  ['overview', 'Overview'],
  ['seniors', 'Senior Approvals'],
  ['courses', 'Courses & Electives'],
  ['grades', 'Grades & CGPA'],
  ['moderation', 'Reports & Moderation'],
  ['accounts', 'User Accounts'],
  ['audit', 'Security Audit Log'],
];

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const Panel = PANELS[tab] || AdminOverviewPanel;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Administrator Console</h1>
          <p className="muted">
            Review senior submissions, manage reference data, grades and accounts.
          </p>
        </div>
      </div>
      <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
        <Tabs value={tab} onChange={setTab} tabs={TABS} />
      </div>
      <Panel />
    </div>
  );
}
