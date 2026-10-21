import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/brand";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/my-reviews")({
  head: () => ({
    meta: [
      { title: "My reviews · ratemyrecruiter" },
      { name: "description", content: "View, edit and delete the recruiter reviews you've written." },
      { property: "og:title", content: "My reviews · ratemyrecruiter" },
      { property: "og:description", content: "View, edit and delete the recruiter reviews you've written." },
    ],
  }),
  component: MyReviews,
});

function MyReviews() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("reviews")
        .select("id,title,overall,created_at,recruiters(name,slug,approved)")
        .eq("user_id", u.user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review deleted");
    qc.invalidateQueries({ queryKey: ["my-reviews"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">My reviews</h1>
      {q.data?.length === 0 && (
        <p>You haven't written any reviews yet. <Link to="/review" className="font-semibold underline">Write one</Link></p>
      )}
      <ul className="space-y-3">
        {q.data?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="font-bold">
                {r.recruiters?.approved ? (
                  <Link to="/r/$slug" params={{ slug: r.recruiters.slug }} className="underline">{r.recruiters.name}</Link>
                ) : (
                  <>{r.recruiters?.name} <span className="text-sm font-normal text-muted-foreground">(awaiting approval)</span></>
                )}
              </p>
              <p>{r.title}</p>
              <Stars value={r.overall} size={16} />
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/review" search={{ edit: r.id }}>Edit</Link></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(r.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
