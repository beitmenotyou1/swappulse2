from pathlib import Path

AUTH_MARKERS = (
    "auth.me(",
    "requireAdmin",
    "role !== 'admin'",
    'role !== "admin"',
    "role === 'admin'",
    'role === "admin"',
    "Authorization",
    "x-internal-secret",
    "INTERNAL_",
)

for path in sorted(Path('base44/functions').glob('*/entry.ts')):
    text = path.read_text(errors='ignore')
    if 'asServiceRole' not in text:
        continue
    if not any(marker in text for marker in AUTH_MARKERS):
        print(path)
