// Ícones permitidos nos itens de um bloco visual (motor criativo v2).
//
// Lista curada de nomes do lucide-react (já instalado). A IA só pode escolher
// daqui — vai como enum no schema de conteúdo —, e o renderer mapeia o nome
// para o componente em src/components/scene/sceneIcons.tsx. Um nome fora da
// lista é descartado no resolvedor (o item fica sem ícone, nunca quebra).
//
// Critério da curadoria: nomes estáveis há muitas versões do lucide, que
// cobrem os 13 domínios da biblioteca sem virar um catálogo de 1.500 ícones
// (que custaria tokens no schema e produziria escolhas aleatórias).

export const SCENE_ICONS = [
  // Genéricos / estrutura
  "Target", "Lightbulb", "Layers", "Puzzle", "Workflow", "Network", "GitBranch", "Repeat",
  "Route", "Compass", "Search", "Eye", "Settings", "Cog", "Wrench", "Hammer", "Key", "Lock",
  "Shield", "Check", "Star", "Sparkles", "Zap", "Flag", "Trophy", "Award", "Crown", "Gem",
  "Clock", "Timer", "Hourglass", "Calendar", "Gauge", "Scale", "Activity",
  // Dados / negócio / finanças
  "TrendingUp", "TrendingDown", "BarChart3", "Coins", "DollarSign", "Wallet", "Briefcase",
  "Building2", "Handshake", "Users", "Megaphone", "ShoppingCart", "Package", "Truck", "Rocket",
  // Tecnologia
  "Cpu", "Server", "Database", "Cloud", "Code", "Bot", "CircuitBoard", "Smartphone", "Monitor", "Bug",
  // Ciência / saúde
  "Atom", "FlaskConical", "Beaker", "Microscope", "Brain", "HeartPulse", "Stethoscope", "Pill",
  "Heart", "Thermometer",
  // Natureza / geografia
  "Leaf", "Sprout", "Sun", "Droplet", "Flame", "Wind", "Waves", "Mountain", "Globe", "MapPin",
  "Recycle",
  // Engenharia / indústria / arquitetura
  "Factory", "Battery", "Car", "Plane", "Anchor", "Landmark",
  // Educação / história / cultura
  "BookOpen", "GraduationCap", "Library", "Scroll", "Palette", "FileText", "MessageCircle",
] as const;

export type SceneIconName = (typeof SCENE_ICONS)[number];

export const isSceneIcon = (v: unknown): v is SceneIconName =>
  typeof v === "string" && (SCENE_ICONS as readonly string[]).includes(v);
