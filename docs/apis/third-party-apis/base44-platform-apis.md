---
description: >-
  How SwapPulse uses Base44 authentication, entities, backend functions and
  managed integrations.
---

# Base44 Platform APIs

Base44 is the application platform behind SwapPulse authentication, entity storage, backend functions and selected managed integrations. Application code uses the configured SDK client rather than embedding platform credentials.

## Active surfaces

| Surface           | Use in SwapPulse                                                                | Caller                                                 |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Authentication    | User sessions, identity and role checks                                         | Browser and backend                                    |
| Entities          | Application records and typed data access                                       | Browser where authorised, backend for privileged work  |
| Backend functions | Validation, aggregation, workflows and external-service adapters                | Browser or trusted services, depending on the function |
| Integrations      | Email, file upload, language models, image generation and structured extraction | Backend functions                                      |
| Workflows         | Scheduled reconciliation, synchronisation and notifications                     | Platform scheduler and trusted operators               |

## SDK example

```javascript
import { base44 } from '@/api/base44Client';

const response = await base44.functions.invoke('get-card-detail', {
  cardId: 'swsh3-136',
  lang: 'en'
});

const card = response?.data ?? response;
```

Entity access follows the generated SDK interface:

```javascript
const records = await base44.entities.CollectionEntry.filter({
  owner_id: currentUser.id
});
```

Only use browser-side entity access when the entity's access rules permit it. Hiding a control in the interface is not authorisation.

## Managed integrations

SwapPulse backend functions may use Base44 Core capabilities for:

* sending email
* uploading files
* invoking language models
* generating images
* extracting structured data from uploaded files

These are internal implementation surfaces, not public SwapPulse proxy APIs.

## Service-role boundary

Service-role access can bypass normal user-scoped rules. It belongs only in trusted backend code. Every privileged function must independently validate the caller, role, ownership, input and requested action.

{% hint style="danger" %}
Never publish Base44 service credentials, provider secrets or privileged SDK configuration in client code, examples or documentation.
{% endhint %}

## Errors and portability

Normalise platform responses at the application boundary, preserve useful non-secret error codes and avoid depending on undocumented response fields. Keep domain logic in SwapPulse adapters so a platform change does not leak into every client.
