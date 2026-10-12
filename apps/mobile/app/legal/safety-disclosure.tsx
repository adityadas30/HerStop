import { LegalScreen } from '@/components/legal/LegalScreen';
import { SAFETY_DISCLOSURE } from '@/constants/legal-content';

export default function SafetyDisclosureScreen() {
  return <LegalScreen document={SAFETY_DISCLOSURE} />;
}
