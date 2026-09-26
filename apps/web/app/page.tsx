import { olfactoryModule, smellMemoryLesson } from "@/src/viewer/olfactory";
import { Viewer } from "@/src/viewer/viewer";

export default function HomePage() {
  return <Viewer module={olfactoryModule} lesson={smellMemoryLesson} />;
}
