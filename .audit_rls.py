from pathlib import Path

missing = []
for path in sorted(Path('base44/entities').glob('*.jsonc')):
    text = path.read_text(errors='ignore')
    if '"rls"' not in text and path.name != 'User.jsonc':
        missing.append(path.name)

print('MISSING_RLS=' + str(len(missing)))
for name in missing:
    print(name)
