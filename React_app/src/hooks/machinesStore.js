import { useMemo } from "react";
import useMessageStore from "../stores/messageStore";



const useMachines = () => {
    const { parsedMessages, isLoading, error, initialize } = useMessageStore();


    const machines = useMemo(() => {
        if (isLoading || error) return [];

        return Array.from(
            new Set(
                parsedMessages
                    .filter((m) => m.type === "string")
                    .map((m) => {
                        const firstSegment = m.data.split(";")[0];
                        if (firstSegment === "teste2" || firstSegment.replace(/\D/g, "").length > 6) return null; // ignora testes
                        return firstSegment.replace(/\D/g, "");
                    })
                    .filter(Boolean)
            )
        );
    }, [parsedMessages, isLoading, error]);
    return machines

}

export default useMachines