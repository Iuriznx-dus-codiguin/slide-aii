// Mapa da lista curada de ícones (supabase/functions/_shared/sceneIcons.ts)
// para os componentes do lucide-react. Nome fora do mapa → sem ícone.
import {
  Target, Lightbulb, Layers, Puzzle, Workflow, Network, GitBranch, Repeat, Route, Compass, Search, Eye,
  Settings, Cog, Wrench, Hammer, Key, Lock, Shield, Check, Star, Sparkles, Zap, Flag, Trophy, Award,
  Crown, Gem, Clock, Timer, Hourglass, Calendar, Gauge, Scale, Activity, TrendingUp, TrendingDown,
  BarChart3, Coins, DollarSign, Wallet, Briefcase, Building2, Handshake, Users, Megaphone, ShoppingCart,
  Package, Truck, Rocket, Cpu, Server, Database, Cloud, Code, Bot, CircuitBoard, Smartphone, Monitor,
  Bug, Atom, FlaskConical, Beaker, Microscope, Brain, HeartPulse, Stethoscope, Pill, Heart, Thermometer,
  Leaf, Sprout, Sun, Droplet, Flame, Wind, Waves, Mountain, Globe, MapPin, Recycle, Factory, Battery,
  Car, Plane, Anchor, Landmark, BookOpen, GraduationCap, Library, Scroll, Palette, FileText, MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { SceneIconName } from "../../../supabase/functions/_shared/sceneIcons.ts";

const ICONS: Record<SceneIconName, LucideIcon> = {
  Target, Lightbulb, Layers, Puzzle, Workflow, Network, GitBranch, Repeat, Route, Compass, Search, Eye,
  Settings, Cog, Wrench, Hammer, Key, Lock, Shield, Check, Star, Sparkles, Zap, Flag, Trophy, Award,
  Crown, Gem, Clock, Timer, Hourglass, Calendar, Gauge, Scale, Activity, TrendingUp, TrendingDown,
  BarChart3, Coins, DollarSign, Wallet, Briefcase, Building2, Handshake, Users, Megaphone, ShoppingCart,
  Package, Truck, Rocket, Cpu, Server, Database, Cloud, Code, Bot, CircuitBoard, Smartphone, Monitor,
  Bug, Atom, FlaskConical, Beaker, Microscope, Brain, HeartPulse, Stethoscope, Pill, Heart, Thermometer,
  Leaf, Sprout, Sun, Droplet, Flame, Wind, Waves, Mountain, Globe, MapPin, Recycle, Factory, Battery,
  Car, Plane, Anchor, Landmark, BookOpen, GraduationCap, Library, Scroll, Palette, FileText, MessageCircle,
};

export function sceneIcon(name: string | undefined | null): LucideIcon | null {
  if (!name) return null;
  return (ICONS as Record<string, LucideIcon | undefined>)[name] ?? null;
}
