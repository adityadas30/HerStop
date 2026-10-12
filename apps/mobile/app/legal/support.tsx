import { LegalScreen } from '@/components/legal/LegalScreen';
import { SUPPORT } from '@/constants/legal-content';

export default function SupportScreen() {
  return <LegalScreen document={SUPPORT} />;
}
