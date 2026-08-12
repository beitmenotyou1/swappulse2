import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { buildAttestation, downloadAttestation } from '@/lib/achievementAttestation';

export default function ExportProofButton({ spec, achievement, userDid }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const exportProof = async () => {
    setExporting(true);
    try {
      const credential = await buildAttestation(spec, achievement, userDid);
      downloadAttestation(credential, `swappulse-${spec.id}.jsonld`);
      toast({ title: 'Proof exported', description: 'Signed JSON-LD attestation downloaded.' });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" className="w-full gap-2" onClick={exportProof} disabled={exporting}>
      <Download className="h-4 w-4" />
      {exporting ? 'Generating…' : 'Export proof (JSON-LD)'}
    </Button>
  );
}