import {
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  DownloadIcon,
  FlaskConicalIcon,
  GraduationCapIcon,
  ImagesIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/content/home";

/** Content config names icons as strings, so no component imports a registry by hand. */
export const iconMap: Record<IconName, LucideIcon> = {
  wallet: WalletIcon,
  campuses: Building2Icon,
  tutor: GraduationCapIcon,
  "hands-on": FlaskConicalIcon,
  calendar: CalendarDaysIcon,
  results: ClipboardListIcon,
  student: UsersIcon,
  shield: ShieldCheckIcon,
  download: DownloadIcon,
  photo: ImagesIcon,
};
