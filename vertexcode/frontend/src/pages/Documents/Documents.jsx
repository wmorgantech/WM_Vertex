import { useAuth } from '../../context/AuthContext';
import InternDocuments from './InternDocuments';
import AdminDocumentReview from './AdminDocumentReview';

const PAGES = {
  SUPER_ADMIN: AdminDocumentReview,
  ADMIN: AdminDocumentReview,
  INTERN: InternDocuments,
};

export default function Documents() {
  const { user } = useAuth();
  const RolePage = PAGES[user?.role];
  if (!RolePage) return <p className="empty-state">You do not have access to this section.</p>;
  return <RolePage />;
}
