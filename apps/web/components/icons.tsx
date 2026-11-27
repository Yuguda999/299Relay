// One icon package: lucide-react. Pages use <Icon name=…> so names stay stable.
import {
  Bell, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ClipboardList, Clock,
  Copy, CreditCard, Download, FileText, Flag, Printer, Footprints, House, Info, Landmark, LayoutDashboard, Lock, LogOut, MapPin, MessageCircle,
  Minus, Monitor, Moon, Package, Plus, Route, ScrollText, Search, Send, Settings, ShieldCheck, ShoppingBag, Star,
  Sun, TriangleAlert, User, Users, Wallet, X, type LucideProps,
} from "lucide-react";

const ICONS = {
  back: ChevronLeft, bell: Bell, wallet: Wallet, bag: ShoppingBag, walk: Footprints, home: House, jobs: ClipboardList,
  user: User, chat: MessageCircle, camera: Camera, lock: Lock, route: Route, check: Check, star: Star, plus: Plus,
  minus: Minus, send: Send, alert: TriangleAlert, settings: Settings, logout: LogOut, shield: ShieldCheck,
  chevron: ChevronRight, down: ChevronDown, bank: Landmark, card: CreditCard, copy: Copy, x: X, search: Search,
  clock: Clock, sun: Sun, moon: Moon, monitor: Monitor, info: Info, ok: CircleCheck, error: CircleAlert, pin: MapPin,
  package: Package, users: Users, file: FileText, download: Download, print: Printer, log: ScrollText, dashboard: LayoutDashboard, flag: Flag,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, className, ...rest }: { name: IconName; size?: number } & LucideProps) {
  const C = ICONS[name];
  return <C aria-hidden="true" size={size} className={className ?? (size ? undefined : "size-4")} strokeWidth={2} {...rest} />;
}
