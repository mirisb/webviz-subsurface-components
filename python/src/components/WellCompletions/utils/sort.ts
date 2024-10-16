import type {
    AttributeType,
    WellPlotData,
} from "@webviz/well-completions-plot";
import {
    createGetWellPlotDataCompareValueFunction,
    SortWellsBy,
    SortDirection,
} from "@webviz/well-completions-plot";

// Default sort methods
export const createAttributeKeyFunction = (
    sortMethod: string
): ((well: WellPlotData) => AttributeType) => {
    // If sortMethod is in SortWellsBy enums
    const isValidSortWellsByEnum = Object.values(SortWellsBy).includes(
        sortMethod as SortWellsBy
    );
    if (isValidSortWellsByEnum) {
        const sortWellsBy = sortMethod as SortWellsBy;
        return createGetWellPlotDataCompareValueFunction(sortWellsBy);
    }

    // Otherwise return a function that returns the attribute value
    return (well) => well.attributes[sortMethod] as AttributeType;
};

export const createSortFunction = (
    sortBy: Record<string, SortDirection>
): ((a: WellPlotData, b: WellPlotData) => 0 | 1 | -1) => {
    const keyFunctions = new Map(
        Object.keys(sortBy).map(
            (sort) =>
                [sort, createAttributeKeyFunction(sort)] as [
                    string,
                    (well: WellPlotData) => AttributeType,
                ]
        )
    );
    return (a: WellPlotData, b: WellPlotData) => {
        for (const sort in sortBy) {
            const keyFunction = keyFunctions.get(sort) as (
                well: WellPlotData
            ) => string | number | undefined;
            const aAttribute = keyFunction(a);
            const bAttribute = keyFunction(b);
            if (aAttribute === bAttribute) continue;
            if (
                aAttribute === undefined ||
                bAttribute === undefined ||
                (sortBy[sort] === SortDirection.ASCENDING &&
                    aAttribute < bAttribute) ||
                (sortBy[sort] !== SortDirection.ASCENDING &&
                    aAttribute > bAttribute)
            )
                return -1;
            else return 1;
        }
        return 0;
    };
};
