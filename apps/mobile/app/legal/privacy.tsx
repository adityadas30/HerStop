import { LegalScreen } from '@/components/legal/LegalScreen';
import { PRIVACY_POLICY } from '@/constants/legal-content';

export default function PrivacyScreen() {
  return <LegalScreen document={PRIVACY_POLICY} />;
}
