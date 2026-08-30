// Maps icon names used in helpContent.js to lucide-react icon components.
// Centralised so HelpContentRenderer doesn't need to import every icon.
import {
  Compass, Search, Filter, Heart, CreditCard, Star, MessageSquare, ArrowLeftRight,
  Package, Library, CheckCircle, Users, Download, Layers, Plus, Copy, FileDown,
  TrendingUp, Award, FileText, Send, Clock, BarChart3, Bell, Wallet,
  ArrowLeftRight as ArrowLeftRight2, Plus as Plus2, MessageSquare as MessageSquare2,
  Scale, Truck, Eye, Flag, Link2, LayoutDashboard, ListChecks, History,
  ShieldCheck, ThumbsUp, AlertTriangle, Home, PenLine, Image, Hash, Repeat2,
  Reply, User, Edit, Camera, BookOpen, LayoutGrid, Palette, CalendarDays,
  MapPin, CheckCircle as CheckCircle2, PartyPopper, Calendar, Trophy, Vote,
  Crown, Mail, Lock, Key, KeyRound, LogIn, ShieldAlert, Bot, Gavel,
  Activity, Wrench, Settings, Globe, Sparkles, Target, Handshake, UserPlus,
  UserCheck, Share2, Copy as Copy2, Send as Send2, Radio, Mic, Circle,
  Medal, Shield, Camera as Camera2, Hash as Hash2, Tag, ThumbsUp as ThumbsUp2,
  Rss, Scissors, Target as Target2, PenLine as PenLine2, BookOpen as BookOpen2,
  Users as Users2, MessageCircle, TrendingUp as TrendingUp2, Eye as Eye2,
  LayoutGrid as LayoutGrid2, CalendarDays as CalendarDays2,
  Fingerprint, Coins,
} from 'lucide-react';

const ICON_MAP = {
  Compass, Search, Filter, Heart, CreditCard, Star, MessageSquare, ArrowLeftRight,
  Package, Library, CheckCircle, Users, Download, Layers, Plus, Copy, FileDown,
  TrendingUp, Award, FileText, Send, Clock, BarChart3, Bell, Wallet,
  Scale, Truck, Eye, Flag, Link2, LayoutDashboard, ListChecks, History,
  ShieldCheck, ThumbsUp, AlertTriangle, Home, PenLine, Image, Hash, Repeat2,
  Reply, User, Edit, Camera, BookOpen, LayoutGrid, Palette, CalendarDays,
  MapPin, PartyPopper, Calendar, Trophy, Vote, Crown, Mail, Lock, Key, KeyRound,
  LogIn, ShieldAlert, Bot, Gavel, Activity, Wrench, Settings, Globe, Sparkles,
  Target, Handshake, UserPlus, UserCheck, Share2, MessageCircle, Radio, Mic,
  Circle, Medal, Shield, Tag, Rss, Scissors, Fingerprint, Coins,
};

export function getHelpIcon(name) {
  return ICON_MAP[name] || null;
}