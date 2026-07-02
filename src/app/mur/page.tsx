import { redirect } from 'next/navigation';

// Le Mur a été regroupé sur l'accueil (section #mur). On conserve /mur comme
// redirection permanente pour ne pas casser les liens/bookmarks existants.
export default function MurPage() {
  redirect('/#mur');
}
