import React from 'react';
import { BookOpen, LayoutGrid, Palette, Eye } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpBinders() {
  return (
    <HelpArticle title="Binders" subtitle="Curate and share showcase binders" slug="binders">
      <HelpSection icon={BookOpen} title="What are Binders?">
        <p>Binders are themed, paginated showcases for your favourite cards. Build a digital binder with up to 10 pages, each with a grid of card slots, drag cards into place, choose a theme, and share it publicly. Binders are mirrored to your AT Protocol PDS so they're portable.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Create a binder:</b> Title, description, and a theme.</li>
          <li><b>Add pages:</b> Up to 10 pages per binder.</li>
          <li><b>Fill slots:</b> Each page has a grid of card slots. Add cards from your collection.</li>
          <li><b>Custom captions:</b> Add a short caption to any slot.</li>
          <li><b>Themes:</b> Classic Purple, Holo Foil, Vintage Leather, Midnight, Rainbow, or Custom.</li>
          <li><b>Visibility:</b> Public, followers, or private.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={LayoutGrid} title="Building a binder">
        <HelpSteps>
          <li>Go to the Binders page and click New Binder.</li>
          <li>Give it a title and choose a theme.</li>
          <li>Add pages and fill the card slots by picking from your collection.</li>
          <li>Drag cards to rearrange them within and across pages.</li>
          <li>Add custom captions if you like.</li>
          <li>Publish. Your binder gets its own page at /binder/:binderId.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Palette} title="Themes">
        <p>Themes control the visual style of your binder: background, borders, and accents. Classic Purple is the default. Holo Foil adds a shiny look. Vintage Leather feels like a real binder. Midnight is dark. Rainbow cycles colours. Custom lets you define your own.</p>
      </HelpSection>
      <HelpSection icon={Eye} title="Sharing">
        <p>Public binders are viewable by anyone and appear on your profile's Binders tab. Public binders with a description are also published as a site.standard.document for long-form discovery across the ATmosphere. Readers can recommend and like your binder.</p>
      </HelpSection>
    </HelpArticle>
  );
}