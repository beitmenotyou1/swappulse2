// §2.8 getMeetup — resolves a meetup for the viewer: their existing RSVP, the
// attendee list (vouch-gated by required_vouches), and live yes/maybe counts.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const meetupId = body.meetupId;
    if (!meetupId) return Response.json({ error: 'meetupId required' }, { status: 400 });

    const meetup = await svc.entities.Meetup.get(meetupId).catch(() => null);
    if (!meetup) return Response.json({ error: 'Meetup not found' }, { status: 404 });

    const isOrganiser = meetup.did === user.did;

    const [myRsvps, attendees, incomingVouches] = await Promise.all([
      svc.entities.MeetupRsvp.filter({ meetup_id: meetupId, did: user.did }).catch(() => []),
      svc.entities.MeetupRsvp.filter({ meetup_id: meetupId }, '-created_date', 50).catch(() => []),
      svc.entities.Vouch.filter({ vouched_did: user.did }).catch(() => []),
    ]);

    const viewerVouches = incomingVouches.length;
    const canSeeAttendees = isOrganiser || viewerVouches >= (meetup.required_vouches || 0);

    const yesCount = attendees.filter((a) => a.attending === 'yes').length;
    const maybeCount = attendees.filter((a) => a.attending === 'maybe').length;

    return Response.json({
      meetup,
      isOrganiser,
      myRsvp: myRsvps[0] || null,
      attendees: canSeeAttendees ? attendees : [],
      viewerVouches,
      canSeeAttendees,
      yesCount,
      maybeCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});