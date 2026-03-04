import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomBackButtonProps {
  onBack?: () => void;
  label?: string;
}

export default function BottomBackButton({ onBack, label = "Tillbaka" }: BottomBackButtonProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.history.back();
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      <Button
        onClick={handleBack}
        className="min-w-[180px] bg-black/85 hover:bg-black text-white border-2 border-white font-bold"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {label}
      </Button>
    </div>
  );
}
