// Icon — thin wrapper over lucide-react-native line icons.
//
// Replaces every emoji glyph in the app with a clean, stroke-based icon so the
// visual language stays consistent (Hevy/Strong). Call sites pass a string
// `name`; the wrapper maps it to a lucide component so callers never import
// lucide directly and an icon swap is a one-line change here.
//
// Default size 20, default color from the active theme's `text` color.

import { StyleSheet } from 'react-native';
import {
  Check,
  CheckCheck,
  CircleCheck,
  CircleCheckBig,
  Circle,
  CircleDot,
  CirclePlus,
  Plus,
  Minus,
  Ellipsis,
  EllipsisVertical,
  Pencil,
  PencilLine,
  SquarePen,
  StickyNote,
  Dumbbell,
  Timer,
  Clock,
  AlarmClock,
  Hourglass,
  Flame,
  Zap,
  Layers,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Replace,
  Repeat,
  RotateCw,
  Trash2,
  X,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  ChartColumn,
  Activity,
  Save,
  Download,
  Flag,
  Trophy,
  Award,
  Medal,
  Calendar,
  CalendarDays,
  History,
  SlidersHorizontal,
  Settings,
  Eye,
  Sparkles,
  List,
  ListPlus,
  Hash,
  Weight,
  Scale,
  Loader,
  Folder,
  FolderPlus,
  Bookmark,
  MoveUp,
  MoveDown,
} from 'lucide-react-native';

import { useAppTheme } from '../theme/index.js';

/**
 * Name → lucide component map. Add new icons here as screens adopt them.
 * @type {Record<string, import('lucide-react-native').LucideIcon>}
 */
const MAP = {
  check: Check,
  'check-check': CheckCheck,
  'check-circle': CircleCheck,
  'check-circle-big': CircleCheckBig,
  circle: Circle,
  'circle-dot': CircleDot,
  'circle-plus': CirclePlus,
  plus: Plus,
  minus: Minus,
  ellipsis: Ellipsis,
  'ellipsis-vertical': EllipsisVertical,
  pencil: Pencil,
  'pencil-line': PencilLine,
  edit: SquarePen,
  'sticky-note': StickyNote,
  dumbbell: Dumbbell,
  timer: Timer,
  clock: Clock,
  alarm: AlarmClock,
  hourglass: Hourglass,
  flame: Flame,
  zap: Zap,
  layers: Layers,
  copy: Copy,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  swap: ArrowLeftRight,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  replace: Replace,
  repeat: Repeat,
  rotate: RotateCw,
  trash: Trash2,
  x: X,
  play: Play,
  pause: Pause,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  chart: ChartColumn,
  activity: Activity,
  save: Save,
  download: Download,
  flag: Flag,
  trophy: Trophy,
  award: Award,
  medal: Medal,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  history: History,
  sliders: SlidersHorizontal,
  settings: Settings,
  eye: Eye,
  sparkles: Sparkles,
  list: List,
  'list-plus': ListPlus,
  hash: Hash,
  weight: Weight,
  scale: Scale,
  loader: Loader,
  folder: Folder,
  'folder-plus': FolderPlus,
  bookmark: Bookmark,
  'move-up': MoveUp,
  'move-down': MoveDown,
};

/**
 * @param {object} props
 * @param {string} props.name        key into the map above
 * @param {number} [props.size=20]
 * @param {string} [props.color]     resolved theme text color by default
 * @param {number} [props.strokeWidth=2]
 * @param {object} [props.style]
 */
export default function Icon({ name, size = 20, color, strokeWidth = 2, style }) {
  const { colors } = useAppTheme();
  const Cmp = MAP[name] ?? Circle;
  return (
    <Cmp
      size={size}
      color={color ?? colors.text}
      strokeWidth={strokeWidth}
      style={style != null ? StyleSheet.flatten(style) : undefined}
    />
  );
}