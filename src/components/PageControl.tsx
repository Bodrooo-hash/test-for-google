interface PageControlProps { total: number; current: number; onSelect?: (index: number) => void; }

const PageControl = ({ total, current, onSelect }: PageControlProps) => {
  return (
    <div className="flex items-center justify-start">
    </div>
  );
};

export default PageControl;
