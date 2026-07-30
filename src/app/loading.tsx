import Card from "@/components/ui/Card";

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Card className="text-center">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-200 text-sm">Loading...</p>
      </Card>
    </div>
  );
}
