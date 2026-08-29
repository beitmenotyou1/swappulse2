import fs from 'node:fs';

const fixes = [
  ['src/components/admin/IncidentsSection.jsx',218,'Toggle incident details'],
  ['src/components/admin/IncidentsSection.jsx',221,'Delete incident'],
  ['src/components/agents/AgentFeedbackBar.jsx',80,'Close correction'],
  ['src/components/auth/ProfileSetup.jsx',110,'Change header image'],
  ['src/components/auth/ProfileSetup.jsx',125,'Change profile photo'],
  ['src/components/binder/SlotPicker.jsx',21,'Close slot picker'],
  ['src/components/cards/AddToCollectionModal.jsx',61,'Close add to collection'],
  ['src/components/cards/CardSearchModal.jsx',52,'Close card search'],
  ['src/components/circles/CreateCircleModal.jsx',91,'Close circle form'],
  ['src/components/collection/CollectionCardRow.jsx',49,'Remove card from collection'],
  ['src/components/comments/CommentComposer.jsx',91,'Cancel reply'],
  ['src/components/crosspost/CrossPostModal.jsx',83,'Close cross-post dialog'],
  ['src/components/feed/CollectionPickerModal.jsx',68,'Close collection picker'],
  ['src/components/feed/ComposeBox.jsx',319,'Remove attached card'],
  ['src/components/feed/MediaComposer.jsx',61,'Remove video'],
  ['src/components/feed/MediaComposer.jsx',102,'Remove link preview'],
  ['src/components/feed/TradeInterestBanner.jsx',33,'Dismiss trade interest'],
  ['src/components/grading/GradingForm.jsx',59,'Close grading form'],
  ['src/components/meetups/CreateMeetupModal.jsx',73,'Close meetup form'],
  ['src/components/messages/MessageButton.jsx',70,'Starting conversation'],
  ['src/components/podcast/PodcastEditorModal.jsx',217,'Close podcast editor'],
  ['src/components/podcast/PodcastEditorModal.jsx',241,'Remove podcast tag'],
  ['src/components/podcast/PodcastEditorModal.jsx',252,'Add podcast tag'],
  ['src/components/podcast/PodcastEditorModal.jsx',283,'Remove podcast chapter'],
  ['src/components/predictions/CreatePollModal.jsx',121,'Close poll form'],
  ['src/components/profile/DomainHandleModal.jsx',97,'Close handle settings'],
  ['src/components/profile/EditProfileModal.jsx',103,'Close profile editor'],
  ['src/components/profile/JournalEditor.jsx',140,'Close journal editor'],
  ['src/components/profile/JournalView.jsx',20,'Close journal'],
  ['src/components/profile/JournalsTab.jsx',81,'View journal'],
  ['src/components/profile/JournalsTab.jsx',82,'Edit journal'],
  ['src/components/profile/JournalsTab.jsx',83,'Delete journal'],
  ['src/components/profile/PastStreamsSection.jsx',79,'Delete past stream'],
  ['src/components/profile/WeeklyDigestToggle.jsx',41,'Weekly digest emails'],
  ['src/components/spaces/CreateSpaceModal.jsx',56,'Close space form'],
  ['src/components/spaces/ExternalStreamSpace.jsx',310,'Leave space'],
  ['src/components/spaces/GoLiveModal.jsx',153,'Close go live form'],
  ['src/components/spaces/GoLiveModal.jsx',232,'Remove topic tag'],
  ['src/components/spaces/GoLiveModal.jsx',243,'Add topic tag'],
  ['src/components/spaces/InPlatformSpace.jsx',359,'Leave space'],
  ['src/components/spaces/SaveAsPodcastModal.jsx',127,'Close save as podcast'],
  ['src/components/spaces/SaveAsPodcastModal.jsx',222,'Remove podcast chapter'],
  ['src/components/spaces/SpaceAdminPanel.jsx',69,'Close space admin panel'],
  ['src/components/stories/CreateStoryModal.jsx',100,'Close story composer'],
  ['src/components/stories/CreateStoryModal.jsx',143,'Choose story background colour'],
  ['src/components/stories/CreateStoryModal.jsx',173,'Remove story segment'],
  ['src/components/stories/StoryCamera.jsx',178,'Close story camera'],
  ['src/components/stories/StoryCamera.jsx',253,'Choose story background colour'],
  ['src/components/stories/StoryViewer.jsx',221,'Close story'],
  ['src/components/stories/StoryViewer.jsx',323,'Close viewers list'],
  ['src/components/trust/VouchForm.jsx',124,'Clear selected collector'],
  ['src/components/ui/toast.jsx',64,'Close notification'],
  ['src/components/wishlist/WishlistAlertModal.jsx',70,'Close wishlist alert settings'],
  ['src/components/wishlist/WishlistAlertModal.jsx',140,'Delete wishlist alert'],
  ['src/pages/BinderDetail.jsx',93,'Delete binder'],
  ['src/pages/BinderDetail.jsx',141,'Previous binder page'],
  ['src/pages/BinderDetail.jsx',151,'Next binder page'],
  ['src/pages/BinderEdit.jsx',257,'Remove binder page'],
  ['src/pages/BinderEdit.jsx',286,'Remove card from binder slot'],
];

const byFile = new Map();
for (const row of fixes) {
  const [file,line,label] = row;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line, label });
}
for (const [file, rows] of byFile) {
  const lines = fs.readFileSync(file,'utf8').split('\n');
  for (const {line,label} of rows.sort((a,b)=>b.line-a.line)) {
    let idx = line - 1;
    let found = -1;
    for (let delta=0; delta<=3; delta++) {
      const candidates = [idx + delta, idx - delta].filter(i => i >= 0 && i < lines.length);
      for (const i of candidates) {
        if (lines[i].includes('<button') && !lines[i].includes('aria-label=')) { found = i; break; }
      }
      if (found >= 0) break;
    }
    if (found < 0) throw new Error(`Could not locate unlabeled button near ${file}:${line}`);
    lines[found] = lines[found].replace('<button', `<button aria-label="${label}"`);
  }
  fs.writeFileSync(file, lines.join('\n'));
}

for (const file of [
  'src/components/collection/InsuranceExport.jsx',
  'src/components/profile/PersonalInfoSection.jsx',
  'src/components/profile/ProfileHandle.jsx',
  'src/components/profile/ThemeTabContent.jsx',
]) {
  const s = fs.readFileSync(file,'utf8');
  fs.writeFileSync(file, s.replaceAll('rel="noreferrer"','rel="noopener noreferrer"'));
}
console.log(`A11Y_PATCHED=${fixes.length}`);
