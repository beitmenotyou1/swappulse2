---
description: End-to-end encrypted private chat
---

# Direct Messages

End-to-end encrypted private chat

## What are Direct Messages?

Direct messages (DMs) are private 1:1 chats with other collectors. They are end-to-end encrypted (E2EE), meaning only you and your recipient can read them. SwapPulse cannot read your messages, ever.

## How encryption works

When you first use DMs, your browser generates an encryption key pair. Your private key lives in your browser's IndexedDB and never leaves your device. Messages are encrypted before sending; only your recipient's private key can decrypt them. This means SwapPulse's servers only ever see encrypted ciphertext.

## Starting a conversation

1. Go to a collector's profile and click Message.
2. Or open the Messages page and start a new conversation.
3. Type your message and send. It's encrypted on your device before it leaves.
4. Your conversation appears in your Messages list.

## Your keys

Your private key is generated and stored locally in your browser. It never gets sent to SwapPulse. This is what makes your messages truly private, but it also means there's no recovery if you lose it.

## Important: losing your key

* If you clear your browser data, switch browsers, or use a new device, you won't be able to read existing encrypted messages there.
* New conversations will work fine, your browser generates a fresh key pair.
* There is no recovery for lost keys by design. SwapPulse cannot decrypt your messages for you.

## Tips

* Don't clear your browser storage if you want to keep access to old messages.
* DMs are for 1:1 conversations. For trade negotiations, use trade threads.

## Open this feature

* [Open Direct Messages in SwapPulse](https://swappulse.org/messages)
* [View the original help route](https://swappulse.org/help/messages)
