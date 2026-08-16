import React from 'react';
import { Lock } from 'lucide-react';
import Avatar from '@/components/Avatar';
import RichText from '@/components/RichText';

export default function MessageBubble({ message, isMine, text, encrypted, pending, failed }) {
  const time = message.created_date
    ? new Date(message.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const raw = message.body || '';
  const isCipher = raw.startsWith('e2ee:');
  const display = text != null ? text : (isCipher ? 'Decrypting…' : raw);
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
      {!isMine && (
        <Avatar name={message.author_name} src={message.author_avatar} size={28} className="shrink-0" />
      )}
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isMine
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-secondary text-secondary-foreground'
          }`}
        >
          <RichText text={display} linkClassName={isMine ? 'font-medium text-primary-foreground hover:underline' : 'font-medium text-primary hover:underline'} />
          {encrypted && !pending && !failed && (
            <span className="mt-0.5 flex items-center gap-0.5 text-[9px] opacity-70" title="End-to-end encrypted">
              <Lock className="h-2.5 w-2.5" /> Encrypted
            </span>
          )}
        </div>
        <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}