import raw from "../../content/olfactory/module.json";
import smellMemory from "../../content/modules/smell-memory.json";
import { readLesson } from "./lesson.js";
import { readModule } from "./module.js";

export const olfactoryModule = readModule(raw);

export const smellMemoryLesson = readLesson(smellMemory, olfactoryModule);
