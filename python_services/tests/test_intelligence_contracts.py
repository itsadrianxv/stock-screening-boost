from app.contracts.intelligence import (
    ResearchReflectionResult,
    ResearchReplanRecord,
    ResearchTaskContract,
)


def test_research_contract_models_accept_valid_payloads():
    contract = ResearchTaskContract(
        requiredSources=["official", "financial"],
        requiredSections=["research_brief", "findings"],
        citationRequired=True,
        analysisDepth="deep",
        deadlineMinutes=90,
    )
    replan = ResearchReplanRecord(
        replanId="gap_1",
        iteration=1,
        triggerNodeKey="agent5_gap_analysis_and_replan",
        reason="material_research_gap",
        missingAreas=["citation coverage"],
        action="append_followup_units",
        resultSummary="Added a follow-up collector.",
        createdAt="2026-03-15T00:00:00Z",
    )
    reflection = ResearchReflectionResult(
        status="warn",
        summary="Research completed with citation warnings.",
        contractScore=78,
        citationCoverage=0.5,
        firstPartyRatio=0.2,
        answeredQuestionCoverage=0.9,
        missingRequirements=["citation_coverage_below_target"],
        qualityFlags=["citation_coverage_low"],
    )

    assert contract.analysisDepth == "deep"
    assert replan.iteration == 1
    assert reflection.contractScore == 78
