import { JsonApiNode, ApiProgramAttrs } from "../models/api-models";
import { Program } from "../models/program";
import { timeService } from "../services/TimeService";

export function transformProgram(node: JsonApiNode<ApiProgramAttrs>): Program {
  const a = node.attributes;
  return {
    id: String(node.id),
    channelId: a.channelId,
    title: a.name || "",
    description: a.description || null,
    startsAt: timeService.parseLocal(a.startTime),
    endsAt: timeService.parseLocal(a.finishTime),
    thumbUrl: a.thumbMp4 || null,
  };
}

export function transformPrograms(nodes: JsonApiNode<ApiProgramAttrs>[]): Program[] {
  return (nodes || [])
    .map(transformProgram)
    .sort((x, y) => x.startsAt - y.startsAt);
}
