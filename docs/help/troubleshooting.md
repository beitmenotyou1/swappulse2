---
description: Practical fixes for common SwapPulse problems.
---

# Troubleshooting

If a service appears unavailable, check the [System Status](https://swappulse.org/status) page first.

## The scanner can't identify my card

Make sure you're in good lighting with the card filling the frame and minimal glare. If the top match is wrong, tap the correct card from the candidates list or search manually. Your correction is recorded and helps the model learn.

## My direct messages show as encrypted / won't decrypt

E2EE direct messages require your private key, which lives in your browser's IndexedDB. If you're on a new browser, cleared your data, or switched devices, you won't be able to read existing encrypted messages there. New conversations will work, your browser generates a fresh key pair. There is no recovery for lost keys by design.

## My story won't post

Stories require a photo, video, or text. Make sure your media has finished uploading (watch the progress bar). If you're on a slow connection, try again, large videos may take a moment. Stories expire after 24 hours, so if an old one is stuck, it may have already expired.

## I can't connect to an in-platform voice space

In-platform spaces use a WebRTC peer mesh. If you can't hear others, check your browser's microphone permissions and try leaving and rejoining the space. Some networks (corporate Wi-Fi, symmetric NATs) block WebRTC connections; try a different network if available. External-stream spaces don't require WebRTC, they just open the stream URL.

## My podcast RSS feed link doesn't work

Your RSS feed is at /api/functions/podcast-rss-feed?did=. Make sure you have at least one published episode, the feed returns 404 if there are no episodes for your DID. Copy the link from your profile's Podcasts tab to get the exact URL with your DID. Podcast apps may take a few hours to index a newly submitted feed.

## My collection isn't syncing

Check your internet connection. Collection entries are stored locally and sync automatically when you reconnect. If items are stuck, try pulling to refresh on the Collection page. If the issue persists, check the System Status page to see if the database is down.

## I'm not getting push notifications

Make sure push is enabled in Settings → Notifications and your browser allows notifications for swappulse.org. Check that the event type (trade matches, price alerts, etc.) is toggled on. Quiet hours may be pausing non-critical alerts, check your quiet hours settings.

## A collector I added to my starter pack isn't showing up

Adding a collector sends them an inclusion request, they don't appear in the pack until they accept. Check the "Pending requests" section on your pack's detail page to see who hasn't responded yet. If they have auto-accept enabled, they'll be promoted immediately with no pending step. You can't force someone into a pack, consent is required by design.

## A trade listing disappeared

Listings expire after 90 days by default. Check if the listing has passed its expiry date. Circle-scoped listings are only visible to members of that circle. The listing may also have been cancelled by the author.

## My email didn't arrive

Check your spam folder. SwapPulse sends from swappulse.org via Proton Mail. If you're using a custom domain alias, make sure your email provider accepts it. Activation links expire after 48 hours, request a new one from the login page.
