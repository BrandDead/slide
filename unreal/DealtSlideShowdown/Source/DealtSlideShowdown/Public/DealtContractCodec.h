#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "DealtEncounterContracts.h"
#include "DealtContractCodec.generated.h"

UCLASS()
class DEALTSLIDESHOWDOWN_API UDealtContractCodec : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "DEALT|Contracts")
    static bool LoadEncounterFile(const FString& FilePath, FDealtEncounterPackage& OutEncounter, FString& OutError);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Contracts")
    static bool ParseEncounterJson(const FString& Json, FDealtEncounterPackage& OutEncounter, FString& OutError);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Contracts")
    static bool ParseResultJson(const FString& Json, FDealtEncounterResult& OutResult, FString& OutError);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Contracts")
    static bool SerializeResultJson(const FDealtEncounterResult& Result, FString& OutJson, FString& OutError);
};
