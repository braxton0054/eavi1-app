import {
  BookOpenIcon,
  CalendarDaysIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  ReceiptIcon,
  Rows3Icon,
  ScrollTextIcon,
  ShapesIcon,
  UserRoundIcon,
  UserRoundSearchIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { DashboardIcon } from "@/lib/content/dashboard";

export const icons: Record<DashboardIcon, typeof LayoutDashboardIcon> = {
  overview: LayoutDashboardIcon,
  applications: UserRoundSearchIcon,
  students: GraduationCapIcon,
  enrollments: UsersIcon,
  programs: BookOpenIcon,
  tutors: ShapesIcon,
  timetable: Rows3Icon,
  calendar: CalendarDaysIcon,
  exams: ClipboardListIcon,
  accounts: WalletIcon,
  cards: ReceiptIcon,
  reports: ScrollTextIcon,
  jobs: ListChecksIcon,
  communication: MegaphoneIcon,
  chat: MessagesSquareIcon,
  profile: UserRoundIcon,
};
