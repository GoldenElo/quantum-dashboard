import { redirect } from 'next/navigation';

// La HeatMap sectorielle a été regroupée sur l'accueil (section #heatmap). On
// conserve /mur comme redirection permanente pour ne pas casser d'anciens liens.
export default function MurPage() {
  redirect('/#heatmap');
}
