// Icon name → lucide-react component map for help content rendering.
// Used by HelpContentRenderer to render section icons from structured data.
import {
  Compass, Layers, Library, Award, BarChart3, CreditCard, ArrowLeftRight,
  LayoutDashboard, ShieldCheck, Home as HomeIcon, PenLine, MessageSquare,
  Hash, User, BookOpen, Users, CalendarDays, Package, PartyPopper, Trophy,
  Vote, Bell, Mail, UserPlus, Share2, Radio, Mic, Target, Medal, Sparkles,
  Settings, LogIn, Activity, ShieldAlert, Gavel, Heart, Search, Filter,
  Plus, Copy, FileDown, TrendingUp, Scale, Users as UsersIcon, Star,
  CheckCircle, AlertTriangle, Info, Zap, Globe, Lock, Bell as BellIcon,
  Send, Download, Upload, Trash2, Edit, Eye, EyeOff, Clock, MapPin,
  Headphones, Podcast, PlayCircle, PauseCircle, Volume2, Camera, Image,
  Tag, Link2, RefreshCw, ChevronRight, ChevronDown, MoreHorizontal,
  HelpCircle, ExternalLink, Gift, Coins, Receipt, Shield, Key, Smartphone,
  Monitor, Moon, Sun, Type, Accessibility, Database, Server, Cloud,
  Wifi, WifiOff, Circle, Check, X, AlertCircle, Loader, Bookmark,
  MessageCircle, ThumbsUp, ThumbsDown, Reply, Repeat2, Share, MoreHorizontal as More,
} from 'lucide-react';

const ICON_MAP = {
  Compass, Layers, Library, Award, BarChart3, CreditCard, ArrowLeftRight,
  LayoutDashboard, ShieldCheck, Home: HomeIcon, PenLine, MessageSquare,
  Hash, User, BookOpen, Users, CalendarDays, Package, PartyPopper, Trophy,
  Vote, Bell, Mail, UserPlus, Share2, Radio, Mic, Target, Medal, Sparkles,
  Settings, LogIn, Activity, ShieldAlert, Gavel, Heart, Search, Filter,
  Plus, Copy, FileDown, TrendingUp, Scale, Star, CheckCircle, AlertTriangle,
  Info, Zap, Globe, Lock, Send, Download, Upload, Trash2, Edit, Eye, EyeOff,
  Clock, MapPin, Headphones, Podcast, PlayCircle, PauseCircle, Volume2,
  Camera, Image, Tag, Link2, RefreshCw, ChevronRight, ChevronDown,
  HelpCircle, ExternalLink, Gift, Coins, Receipt, Shield, Key, Smartphone,
  Monitor, Moon, Sun, Type, Accessibility, Database, Server, Cloud, Wifi,
  WifiOff, Circle, Check, X, AlertCircle, Loader, Bookmark, MessageCircle,
  ThumbsUp, ThumbsDown, Reply, Repeat2, Share, More,
};

export function getIcon(name) {
  return ICON_MAP[name] || null;
}